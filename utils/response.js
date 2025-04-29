exports.response = ({ status, message, data, error }) => {
  return {
    status: status ? `${status}` : 'success',
    message: message ? `${message}` : 'success',
    data: data || {},
    error: error ? `${error}` : '',
  };
};
