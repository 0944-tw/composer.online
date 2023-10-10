const axios = require('axios');

async function verifyRecaptcha(token, secretKey,ip) {
  try {
    const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: {
        secret: secretKey,
        response: token,
        remoteip: ip,
      },
    });
    return response.data.success;
  } catch (error) {
    console.error(error);
    return false;
  }
}

module.exports = verifyRecaptcha;