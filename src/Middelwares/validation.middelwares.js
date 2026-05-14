export const validation = (schema) => {
    return (req, res, next) => {
        const validationResults = schema.validate(req.body, { aboortEarly: false })
        if (validationResults.error) {
            return res.status(400).json({
                message: "Validation Error",
                error: validationResults.error
            })
        }


        return next()
    }
}