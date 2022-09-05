import crypto from 'crypto';

/**
 * Generate a cookie by timestamp and sha1
 * @return 
 */
function generate() {
    return crypto.createHash("sha1").update(Date.now().toString()).digest("base64");
}

const cookieCrypto = {
    generate
};

export default cookieCrypto;