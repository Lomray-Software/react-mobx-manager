"""Submit one Context7 refresh; acceptance is not completed indexing."""

import json
import os
import re
import sys
import urllib.error
import urllib.request

ENDPOINT = "https://context7.com/api/v1/refresh"


class RefreshError(Exception):
    """Safe-to-log failure without response bodies or credentials."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def refresh(env, opener=None):
    token = env.get("CONTEXT7_API_KEY", "")
    repository = env.get("GITHUB_REPOSITORY", "").lower()
    branch = env.get("CONTEXT7_BRANCH", "")
    if not token or any(c in token for c in "\r\n"):
        raise RefreshError("CONTEXT_7 is missing or invalid; no request sent.")
    if not re.fullmatch(r"[a-z0-9_.-]+/[a-z0-9_.-]+", repository):
        raise RefreshError("Invalid repository identifier; no request sent.")
    if not branch or any(c.isspace() for c in branch):
        raise RefreshError("Invalid branch; no request sent.")
    request = urllib.request.Request(
        ENDPOINT,
        data=json.dumps({"libraryName": "/" + repository, "branch": branch}).encode(),
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        method="POST",
    )
    client = opener or urllib.request.build_opener(NoRedirect())
    try:
        with client.open(request, timeout=30) as response:
            status = response.status
            body = response.read(65537)
    except urllib.error.HTTPError as exc:
        raise RefreshError(f"Context7 HTTP {exc.code}; no automatic retry.") from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise RefreshError("Transport failed; acceptance unknown. Inspect before retrying.") from None
    if status != 200 or len(body) > 65536:
        raise RefreshError("Unexpected response; acceptance unknown. Inspect before retrying.")
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        raise RefreshError("Invalid JSON response; acceptance unknown. Inspect before retrying.") from None
    if not isinstance(payload, dict) or payload.get("message") != "Refresh started successfully":
        raise RefreshError("Unrecognized response; acceptance unknown. Inspect before retrying.")
    return f"Refresh accepted for /{repository} ({branch}); external content verification is still required."


if __name__ == "__main__":
    try:
        print(refresh(os.environ))
    except RefreshError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
