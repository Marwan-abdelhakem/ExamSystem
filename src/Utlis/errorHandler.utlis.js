const globalErrorHandler = (err, req, res, next) => {
    const statusCode = err.cause || 500
    return res
        .status(statusCode)
        .json({ message: "somthing went Error", error: err.message, stack: err.stack })
}

export default globalErrorHandler