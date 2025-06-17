const { defineBackend } = require("@aws-amplify/backend");
const { auth } = require("./auth/resource");

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
    auth,
});

module.exports = backend;