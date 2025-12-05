from enum import Enum


class Tags(Enum):
    Users = "Users"
    Settings = "Settings"
    Measurements = "Measurements"
    Device = "Device"
    Family = "Family"


tags_metadata = [
    {
        "name": Tags.Users,
        "description": "Operations with users.",
    },
{
        "name": Tags.Family,
        "description": "Operations with families.",
    },
    {
        "name": Tags.Settings,
        "description": "Operations with managing devices and family.",
    },
    {
        "name": Tags.Measurements,
        "description": "Getting measurements from devices.",
    },
    {
        "name": Tags.Device,
        "description": "Operations with devices.",
    },
]
