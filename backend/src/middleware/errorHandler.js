// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error(err);
  const status = err.response?.status || err.status || 500;
  const message = err.response?.data?.error_description || err.response?.data?.error?.message || err.message || 'Internal Server Error';
  
  res.status(status).json({ error: message });
};

module.exports = errorHandler;
