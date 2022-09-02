import validator from 'validator';

export function isValidURL(urlString) {
    return validator.isURL(urlString, { 
        protocols: ['http','https'], 
        require_protocol: true, 
        allow_underscores: true 
    });
}

export function isValidJWT(jwtString) {
    // validate logic

    // hard code
    return false;
}