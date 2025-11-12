enum BLEServiceEnum {
  WIFI_SERVICE = 0x190A,
  BASIC_INFO_SERVICE = 0x180C,
  SENSORS_SERVICE = 0x180D
}

export default BLEServiceEnum;

export const AdvertisedServices = [
  BLEServiceEnum.BASIC_INFO_SERVICE,
  BLEServiceEnum.SENSORS_SERVICE
];
export const OptionalServices = [
  BLEServiceEnum.WIFI_SERVICE
];