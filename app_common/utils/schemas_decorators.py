import typing
from copy import deepcopy
from typing import Optional, Type, Any, Tuple, Literal, Union

from pydantic import BaseModel, create_model, model_validator
from pydantic.fields import FieldInfo
from pydantic.main import IncEx


class UpdateModel(BaseModel):
    """
    Base model for all update schemas.
    Adds validator to check if not nullable fields are not set to "null".
    Adds model_dump_null() to automatically excludes unset and changes "null" literal to None.
    """
    @model_validator(mode='after')
    def validate_not_null(self):
        for field_name, field_info in self.model_fields.items():
            if getattr(self, field_name) == "null":
                if not any(issubclass(Null, t) for t in typing.get_args(field_info.annotation)):
                    raise ValueError(f"Field \"{field_name}\" cannot be null.")
        return self

    def model_dump_null(
            self,
            *,
            mode: Literal['json', 'python'] | str = 'python',
            include: IncEx | None = None,
            exclude: IncEx | None = None,
            context: Any | None = None,
            by_alias: bool = False,
            #exclude_unset: bool = False,
            exclude_defaults: bool = False,
            exclude_none: bool = False,
            round_trip: bool = False,
            warnings: bool | Literal['none', 'warn', 'error'] = True,
            serialize_as_any: bool = False,
    ) -> dict[str, Any]:
        """Removes unset and changes "null" to None."""
        return {
            k: v if v != "null" else None
            for k, v in self.model_dump(
                            mode=mode,
                            by_alias=by_alias,
                            include=include,
                            exclude=exclude,
                            context=context,
                            exclude_unset=True,
                            exclude_defaults=exclude_defaults,
                            exclude_none=exclude_none,
                            round_trip=round_trip,
                            warnings=warnings,
                            serialize_as_any=serialize_as_any,
                        ).items()
        }


class Null(BaseModel):
    pass


def update_model(omit: list[str] | str = None, nullable: list[str] | str = None):
    """
    Omit pydantic fields from model.
    Make pydantic fields nullable.
    Make all fields optional.
    Adds new method dump_model_null().
    Adds validator for Not Null Constraint, if the field is not specified in nullable.
    !!! Deletes config dict and all methods !!!
    !!! Do not use with other decorators !!!
    """
    omitted_fields: list[str] = omit if isinstance(omit, list) else [omit]
    nullable_fields: list[str] = nullable if isinstance(nullable, list) else [nullable]

    def dec(_class: Type[BaseModel]):
        def make_field_optional(field_name: str, field: FieldInfo, default: Any = None) -> Tuple[Any, FieldInfo]:
            new = deepcopy(field)
            new.default = default
            if field_name in nullable_fields:
                new.annotation = Union[Optional[field.annotation], Null, Literal["null"]]  # type ignore, make nullable
            else:
                new.annotation = Optional[field.annotation]  # type ignore
            return new.annotation, new

        for field in omitted_fields:
            _class.model_fields.pop(field, None)
        return create_model(
            _class.__name__,
            __base__=UpdateModel,
            __module__=_class.__module__,
            **{
                field_name: make_field_optional(field_name, field_info)
                for field_name, field_info in _class.model_fields.items()
            }
        )

    return dec


def omit(*fields):
    """
    Omit pydantic fields from model.
    !!! Deletes all methods !!!
    !!! Do not use with other decorators !!!
    """

    def dec(_class: Type[BaseModel]):
        for field in fields:
            _class.model_fields.pop(field, None)
        _clone = create_model(
            _class.__name__,
            __config__=_class.model_config,
            **{
                k: (v.annotation, v)
                for k, v in _class.model_fields.items()},
        )
        setattr(_clone, "__pydantic_parent_namespace__", {})
        return _clone

    return dec


def optional_model(model: Type[BaseModel]):
    def make_field_optional(field: FieldInfo, default: Any = None) -> Tuple[Any, FieldInfo]:
        new = deepcopy(field)
        new.default = default
        new.annotation = Optional[field.annotation]  # type: ignore
        return new.annotation, new

    return create_model(
        model.__name__,
        __base__=model,
        __module__=model.__module__,
        **{
            field_name: make_field_optional(field_info)
            for field_name, field_info in model.model_fields.items()
        }
    )
