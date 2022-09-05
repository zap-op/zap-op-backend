const SCAN_STATUS = {
    SESSION_INITIALIZED_SUCCEED: {
        scanStatus: 0,
        message: "Scan session initialized succeed"
    },
    SESSION_INITIALIZED_FAIL: {
        scanStatus: -1,
        message: "Scan session initialized fail"
    },
    INVAVLID_URL: {
        scanStatus: -2,
        message: "Invalid URL"
    },
    INVALID_SESSION: {
        scanStatus: -3,
        message: "Invalid scan session"
    }
}

export default SCAN_STATUS;