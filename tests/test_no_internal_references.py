"""The release must not leak the internal project it was extracted from.

This is a real check, not a formality: the source tree hard-codes a company
object-store path, a cluster job submitter, container registry addresses, and --
in the original job specifications -- a plaintext job password. Any of those
reaching a public repository is a disclosure, so the check runs in CI and fails
the build rather than warning.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

# Substring, plus why it must never appear.
FORBIDDEN: dict[str, str] = {
    "starvla": "upstream project name",
    "horizon-bucket": "internal object-store mount",
    "hobot": "internal domain / container registry",
    "newk8s": "cluster credential",
    "job_passwd": "plaintext credential",
    "axi-the-cat": "personal experiment-tracking account",
    "sen.wang": "personal account",
    "sen02": "personal account",
    "aidi-inf-cli": "internal job submitter",
    "acloud": "internal queue name",
    "robot_lab": "internal storage namespace",
    "rynn50k": "internal run-series identifier",
    "horizon.auto": "internal LLM gateway endpoint",
}

# Regexes for shapes rather than fixed strings.
FORBIDDEN_PATTERNS: dict[str, str] = {
    r"\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b": "internal IPv4 address",
    r"\bproject-[a-z0-9]+-[a-z0-9-]*acloud[a-z0-9-]*\b": "cluster queue name",
    r"docker\.[a-z0-9.-]+/[a-z0-9._/-]+:[a-z0-9._-]+": "private container image",
    # A literal credential, as opposed to a lookup. The annotation tooling in the
    # source workspace hard-codes one of these, so the shape is worth catching.
    # No leading \b: the real-world offender is named `HMIND_API_KEY`.
    r"(?i)(api_key|apikey|secret|passwd|password)\s*[:=]\s*[\"'][A-Za-z0-9_\-]{12,}[\"']": "hard-coded credential",
}

SEARCHED_SUFFIXES = {".py", ".md", ".yaml", ".yml", ".json", ".sh", ".toml", ".cff", ".txt", ".cfg", ".ini"}

# Licence and notice files carry no usable suffix -- `LICENSE` has none at all and
# `LICENSE-Apache 2.0` parses as `.0` -- so a suffix-only scan silently skipped
# them, which made the `LICENSE` allowlist entry below dead code. Match by name.
SEARCHED_NAMES = {"LICENSE", "LICENSE-Apache 2.0", "LICENSE-BSD 3 Clause", "NOTICE"}

# `website/` is published separately through gh-pages and is excluded from this
# repository by .gitignore, so it is not part of the release this test guards.
# It holds genuine internal references (source maps naming personal accounts and
# the object-store mount); whatever publishes it must run its own check.
SKIPPED_DIRS = {".git", "__pycache__", ".ruff_cache", ".pytest_cache", "outputs", "artifacts", "build", "dist", "website"}

# The upstream project name is not a secret -- the MIT licence obliges us to
# credit it. It is allowed only in the files whose job is attribution, and only
# these needles; the infrastructure names below are never allowed anywhere.
# `rynn50k` survives in UPSTREAM_SOURCES.json source paths on purpose: falsifying
# a provenance path to hide an upstream directory name would defeat the file.
ATTRIBUTION_FILES = {"README.md", "CITATION.cff", "LICENSE", "NOTICE", "UPSTREAM_SOURCES.json"}

# Two modules are verbatim ports whose MIT headers must name their origin. These
# are matched on the full relative path, not the bare filename, so that a future
# `protocol.py` elsewhere in the tree does not inherit the exemption.
ATTRIBUTION_PATHS = {"cogwam/serve/protocol.py", "cogwam/training/overwatch.py"}

ATTRIBUTION_NEEDLES = {"starvla", "rynn50k"}

# This file necessarily contains the forbidden strings.
SELF = Path(__file__).name


def _candidate_files() -> list[Path]:
    files = []
    for path in REPO_ROOT.rglob("*"):
        if not path.is_file() or (path.suffix not in SEARCHED_SUFFIXES and path.name not in SEARCHED_NAMES):
            continue
        if any(part in SKIPPED_DIRS for part in path.parts):
            continue
        if path.name == SELF:
            continue
        files.append(path)
    return files


def test_no_internal_references() -> None:
    offences: list[str] = []
    for path in _candidate_files():
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        lowered = text.lower()
        relative = path.relative_to(REPO_ROOT)
        for needle, reason in FORBIDDEN.items():
            if needle in lowered:
                attributing = path.name in ATTRIBUTION_FILES or relative.as_posix() in ATTRIBUTION_PATHS
                if attributing and needle in ATTRIBUTION_NEEDLES:
                    continue
                line = next(
                    (i for i, raw in enumerate(lowered.splitlines(), 1) if needle in raw),
                    0,
                )
                offences.append(f"{relative}:{line}: {needle!r} ({reason})")
        for pattern, reason in FORBIDDEN_PATTERNS.items():
            match = re.search(pattern, text)
            if match:
                line = text[: match.start()].count("\n") + 1
                offences.append(f"{relative}:{line}: {match.group(0)!r} ({reason})")

    assert not offences, "internal references leaked into the release:\n" + "\n".join(sorted(offences))


def test_searched_something() -> None:
    """Guard against the scan silently matching zero files after a refactor."""
    assert len(_candidate_files()) > 20
