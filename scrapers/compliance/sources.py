"""Which state adapter a compliance run uses. Only Washington is built."""

from __future__ import annotations


def supported_states() -> tuple[str, ...]:
    return ("WA",)


def require_state(state_code: str) -> str:
    code = state_code.strip().upper()
    if code in supported_states():
        return code
    raise SystemExit(
        f"{code} is not built yet. Later adapters: Pennsylvania inspection reports, "
        "CMS Care Compare for nursing homes."
    )
