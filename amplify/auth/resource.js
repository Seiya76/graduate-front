const { defineAuth } = require("@aws-amplify/backend");

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
const auth = defineAuth({
    loginWith: {
        email: true,
    },
    userAttributes: {
        email: {
            required: true,
            mutable: true,
        },
        name: {
            required: false,
        mutable: true,
        },
    },
    accountRecovery: 'email',
    // パスワードポリシー設定
    passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSymbols: false,
    },
});

module.exports = { auth };