import validator from 'validator';

/**
 * Check if valid URL
 * @param {string} urlString
 */
function isValidURL(urlString) {
    return validator.isURL(urlString, {
        protocols: ['http', 'https'],
        require_protocol: true,
        allow_underscores: true
    });
}

/**
 * Check ...
 * @param {string} jwtString
 */
function isValidJWT(jwtString) {
    // validate logic

    // hard code
    return false;
}

/**
 * Check if string type and not empty
 * @param {string} string
 */
function isValidString(string) {
    return typeof string === "string" && string;
}

/**
 * Check if array type and not empty
 * @param {Array} array
 */
function isValidArray(array) {
    return Array.isArray(array) && array.length > 0;
}

/**
 * Check if Document with the field is exsist
 * @param {Schema.methods} model Mongoose model instance
 * @param {string} fieldKey Key name's string
 * @param {string} fieldValue Value string map to key name 
 */
function isDocExists_MONGODB(model, fieldKey, fieldValue) {
    return model.exists({
        [fieldKey]: fieldValue
    }, (error, doc) => {
        if (error) {
            console.log(error);
        }
        return doc ? true : false;
    });
}

/**
 * Check if object or variable is undenfined
 * @param {any} object Mongoose model instance
 * @returns {boolean}
 */

function isUndenfined(object) {
    if (typeof object === "undenfined") {
        return true;
    }
    return false;
}

const _validator = {
    isValidURL,
    isValidJWT,
    isValidString,
    isValidArray,
    isDocExists_MONGODB,
    isUndenfined
};

export default _validator;