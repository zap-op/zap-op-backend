const SCAN_STATUS = {
  SESSION_INITIALIZE_SUCCEED: {
    scanStatus: 0,
    msg: "Scan session initialize succeed!",
  },
  SESSION_INITIALIZE_FAIL: {
    scanStatus: -1,
    msg: "Scan session initialize fail!",
  },
  INVAVLID_URL: {
    scanStatus: -2,
    msg: "Invalid URL!",
  },
  INVALID_SESSION: {
    scanStatus: -3,
    msg: "Invalid scan session!",
  },

  ZAP_SERVICE_ERROR: {
    scanStatus: -4,
    msg: "ZAP service error!",
  },

  INTERNAL_ERROR: {
    scanStatus: -5,
    msg: "Service internal error!",
  },
};

export default SCAN_STATUS;
