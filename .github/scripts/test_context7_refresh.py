"""Offline tests: no real API key and no external request."""

import contextlib
import http.client
import io
import pathlib
import runpy
import json
import unittest
import urllib.error
from unittest.mock import Mock, patch

from context7_refresh import ENDPOINT, NoRedirect, RefreshError, refresh


class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.env = {"CONTEXT7_API_KEY": "test-only-key", "GITHUB_REPOSITORY": "Example/Library", "CONTEXT7_BRANCH": "prod"}
        self.client = Mock()
        self.response = Mock()
        self.response.status = 200
        self.response.read.return_value = b'{"message":"Refresh started successfully"}'
        self.client.open.return_value.__enter__ = Mock(return_value=self.response)
        self.client.open.return_value.__exit__ = Mock(return_value=False)

    def test_exact_request_and_acceptance(self):
        message = refresh(self.env, self.client)
        request = self.client.open.call_args.args[0]
        self.assertEqual(request.full_url, "https://context7.com/api/v1/refresh")
        self.assertEqual(request.method, "POST")
        self.assertEqual(json.loads(request.data), {"libraryName": "/example/library", "branch": "prod"})
        self.assertEqual(request.get_header("Authorization"), "Bearer test-only-key")
        self.assertEqual(self.client.open.call_args.kwargs, {"timeout": 30})
        self.response.read.assert_called_once_with(65537)
        self.assertIn("verification is still required", message)
        self.assertNotIn(self.env["CONTEXT7_API_KEY"], message)

    def test_default_branch_omits_named_version_selector(self):
        env = {k: v for k, v in self.env.items() if k != "CONTEXT7_BRANCH"}
        message = refresh(env, self.client)
        self.assertEqual(json.loads(self.client.open.call_args.args[0].data), {"libraryName": "/example/library"})
        self.assertIn("configured default branch", message)
        self.client.open.assert_called_once()

    def test_error_body_only_emits_fixed_diagnostics(self):
        cases = [
            (b'{"error":"branch_not_found","message":"test-only-key"}', "Requested named branch"),
            (b'{"error":"library_not_found","message":"test-only-key"}', "Library identifier"),
            (b'{"error":"test-only-key"}', "Unclassified"),
            (b'{"error":["branch_not_found"]}', "Unclassified"),
            (b'{"error":{"secret":"test-only-key"}}', "Unclassified"),
            (b'[]', "Unclassified"),
            (b'\xff', "Unclassified"),
            (b'x' * 65537, "Unclassified"),
        ]
        for body, expected in cases:
            with self.subTest(expected=expected, size=len(body)):
                client = Mock()
                response = Mock()
                response.read.return_value = body
                client.open.side_effect = urllib.error.HTTPError(ENDPOINT, 400, "test-only-key", {}, response)
                with self.assertRaisesRegex(RefreshError, expected) as caught:
                    refresh(self.env, client)
                self.assertNotIn("test-only-key", str(caught.exception))
                self.assertTrue(caught.exception.__suppress_context__)
                response.read.assert_called_once_with(65537)
                client.open.assert_called_once()

    def test_error_body_read_failure_is_sanitized(self):
        for error in [http.client.IncompleteRead(b"test-only-key", 42), OSError("test-only-key"), TimeoutError("test-only-key")]:
            client = Mock()
            response = Mock()
            response.read.side_effect = error
            client.open.side_effect = urllib.error.HTTPError(ENDPOINT, 400, "test-only-key", {}, response)
            with self.assertRaisesRegex(RefreshError, "Unclassified") as caught:
                refresh(self.env, client)
            self.assertNotIn("test-only-key", str(caught.exception))
            self.assertTrue(caught.exception.__suppress_context__)
            client.open.assert_called_once()

    def test_invalid_inputs_never_send(self):
        for field, value in [("CONTEXT7_API_KEY", ""), ("CONTEXT7_API_KEY", "a\nb"), ("GITHUB_REPOSITORY", "https://bad.example"), ("GITHUB_REPOSITORY", "owner/repo/extra"), ("CONTEXT7_BRANCH", "prod\n")]:
            with self.subTest(field=field, value=value):
                with self.assertRaises(RefreshError):
                    refresh({**self.env, field: value}, self.client)
        self.client.open.assert_not_called()

    def test_http_errors_never_retry_or_echo_body(self):
        for code in [301, 302, 400, 401, 403, 404, 429, 500]:
            with self.subTest(code=code):
                client = Mock()
                client.open.side_effect = urllib.error.HTTPError(ENDPOINT, code, "test-only-key", {}, io.BytesIO(b"test-only-key"))
                with self.assertRaisesRegex(RefreshError, f"HTTP {code}; no automatic retry") as result:
                    refresh(self.env, client)
                self.assertNotIn("test-only-key", str(result.exception))
                client.open.assert_called_once()

    def test_transport_errors_are_uncertain_and_sanitized(self):
        for error in [TimeoutError("test-only-key"), urllib.error.URLError("test-only-key"), OSError("test-only-key")]:
            with self.subTest(error=type(error)):
                client = Mock()
                client.open.side_effect = error
                with self.assertRaisesRegex(RefreshError, "acceptance unknown") as result:
                    refresh(self.env, client)
                self.assertNotIn("test-only-key", str(result.exception))
                client.open.assert_called_once()

    def test_only_documented_acceptance_counts(self):
        for status, body in [(202, b'{}'), (200, b'not json'), (200, b'\xff'), (200, b'[]'), (200, b'{"error":"test-only-key"}'), (200, b'{"message":"queued"}'), (200, b'x' * 65537)]:
            with self.subTest(status=status, body_size=len(body)):
                self.response.status = status
                self.response.read.return_value = body
                with self.assertRaisesRegex(RefreshError, "acceptance unknown") as result:
                    refresh(self.env, self.client)
                self.assertNotIn("test-only-key", str(result.exception))

    def test_production_builder_installs_redirect_guard(self):
        with patch("urllib.request.build_opener", return_value=self.client) as build:
            refresh(self.env)
        build.assert_called_once()
        self.assertEqual(len(build.call_args.args), 1)
        self.assertIsInstance(build.call_args.args[0], NoRedirect)
        self.client.open.assert_called_once()

    def test_http_parser_failures_are_safe_in_cli(self):
        for stage in ("open", "read"):
            with self.subTest(stage=stage):
                client = Mock()
                response = Mock(status=200)
                client.open.return_value.__enter__ = Mock(return_value=response)
                client.open.return_value.__exit__ = Mock(return_value=False)
                if stage == "open":
                    class FakeSocket:
                        def makefile(self, *args, **kwargs):
                            return io.BytesIO(b"test-only-key\r\n")
                    try:
                        http.client.HTTPResponse(FakeSocket()).begin()
                    except http.client.BadStatusLine as error:
                        client.open.side_effect = error
                    else:
                        self.fail("Expected malformed status line to fail")
                else:
                    response.read.side_effect = http.client.IncompleteRead(b"test-only-key", 100)
                output = io.StringIO()
                with patch.dict("os.environ", self.env, clear=True), patch("urllib.request.build_opener", return_value=client), contextlib.redirect_stderr(output):
                    with self.assertRaises(SystemExit) as stopped:
                        runpy.run_path(str(pathlib.Path(__file__).with_name("context7_refresh.py")), run_name="__main__")
                self.assertEqual(stopped.exception.code, 1)
                self.assertIn("acceptance unknown", output.getvalue())
                self.assertNotIn("test-only-key", output.getvalue())
                self.assertNotIn("Traceback", output.getvalue())
                client.open.assert_called_once()

    def check_deep_json_cli(self, status):
        canary = "OFFLINE_DEEP_JSON_CANARY_NOT_A_SECRET"
        body = b'{"error":' + b'[' * 16000 + b'0' + b']' * 16000 + b'}'
        self.assertLess(len(body), 65536)
        client = Mock()
        response = Mock(status=status)
        response.read.return_value = body
        if status == 400:
            client.open.side_effect = urllib.error.HTTPError(ENDPOINT, status, canary, {}, response)
        else:
            client.open.return_value.__enter__ = Mock(return_value=response)
            client.open.return_value.__exit__ = Mock(return_value=False)
        output = io.StringIO()
        env = {**self.env, "CONTEXT7_API_KEY": canary}
        with patch.dict("os.environ", env, clear=True), patch("urllib.request.build_opener", return_value=client), contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            with self.assertRaises(SystemExit) as stopped:
                runpy.run_path(str(pathlib.Path(__file__).with_name("context7_refresh.py")), run_name="__main__")
        self.assertEqual(stopped.exception.code, 1)
        text = output.getvalue()
        self.assertIn("acceptance unknown", text.lower())
        self.assertIn("inspect before retrying", text.lower())
        self.assertNotIn("Traceback", text)
        self.assertNotIn(canary, text)
        self.assertNotIn("Refresh accepted", text)
        response.read.assert_called_once_with(65537)
        client.open.assert_called_once()

    def test_deep_error_json_is_safe_in_cli(self):
        self.check_deep_json_cli(400)

    def test_deep_success_json_is_safe_in_cli(self):
        self.check_deep_json_cli(200)

    def test_redirect_handler_does_not_forward_request(self):
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://other.example"))


if __name__ == "__main__":
    unittest.main()
