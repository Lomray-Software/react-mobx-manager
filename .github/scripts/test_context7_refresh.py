"""Offline tests: no real API key and no external request."""

import io
import json
import unittest
import urllib.error
from unittest.mock import Mock

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
        self.assertEqual(request.full_url, ENDPOINT)
        self.assertEqual(request.method, "POST")
        self.assertEqual(json.loads(request.data), {"libraryName": "/example/library", "branch": "prod"})
        self.assertEqual(request.get_header("Authorization"), "Bearer test-only-key")
        self.assertEqual(self.client.open.call_args.kwargs, {"timeout": 30})
        self.response.read.assert_called_once_with(65537)
        self.assertIn("verification is still required", message)
        self.assertNotIn(self.env["CONTEXT7_API_KEY"], message)

    def test_invalid_inputs_never_send(self):
        for field, value in [("CONTEXT7_API_KEY", ""), ("CONTEXT7_API_KEY", "a\nb"), ("GITHUB_REPOSITORY", "https://bad.example"), ("GITHUB_REPOSITORY", "owner/repo/extra"), ("CONTEXT7_BRANCH", ""), ("CONTEXT7_BRANCH", "prod\n")]:
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

    def test_redirect_handler_does_not_forward_request(self):
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://other.example"))


if __name__ == "__main__":
    unittest.main()
