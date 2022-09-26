const SCAN_STATUS = {
    SESSION_INITIALIZED_SUCCEED: {
        scanStatus: 0,
        message: "Scan session initialize succeed!"
    },
    SESSION_INITIALIZED_FAIL: {
        scanStatus: -1,
        message: "Scan session initialize fail!"
    },
    INVAVLID_URL: {
        scanStatus: -2,
        message: "Invalid URL!"
    },
    INVALID_SESSION: {
        scanStatus: -3,
        message: "Invalid scan session!"
    },
    ZAP_SERVICE_ERROR: {
        scanStatus: -4,
        message: "ZAP service error!"
    }
}

export default SCAN_STATUS;