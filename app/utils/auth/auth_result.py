from typing import final


class Result:
    _is_error: bool = False
    _error_msg: str | None = ""
    _value: str | None = None

    def __init__(self, is_error, error_msg, value):
        self._is_error = is_error
        self._error_msg = error_msg
        self._value = value

    @staticmethod
    def err(msg: str) -> "Result":
        return Result(True, msg, None)

    @staticmethod
    def ok(val: str) -> "Result":
        return Result(False, None, val)

    def __bool__(self) -> bool:
        return not self._is_error

    @property
    def value(self):
        return self._value

    @property
    def error(self):
        return self._error_msg
