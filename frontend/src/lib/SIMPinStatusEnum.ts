enum SIMPinStatusEnum {
  UNKNOWN = 0,
  READY = 1,
  PIN_REQUIRED = 2,
  PUK_REQUIRED = 3,
  PH_SIM_PIN_REQUIRED = 4,
  PH_NET_PIN_REQUIRED = 5,
  SIM_NOT_INSERTED = 6,
}

export default SIMPinStatusEnum;