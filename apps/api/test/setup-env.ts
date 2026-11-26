// Runs before any test module is imported (jest setupFiles), so the Nest
// module decorators read the test values, not the .env fallbacks.
// CI overrides these with its own passwords via the environment.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://queuepass_app:qp_app_dev@localhost:5432/queuepass_test';
process.env.PUBLIC_DATABASE_URL = process.env.PUBLIC_DATABASE_URL || 'postgresql://queuepass_public:qp_pub_dev@localhost:5432/queuepass_test';
process.env.MIGRATION_DATABASE_URL = process.env.MIGRATION_DATABASE_URL || 'postgresql://queuepass_owner:qp_owner_dev@localhost:5432/queuepass_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.SMS_PROVIDER = 'dev';
