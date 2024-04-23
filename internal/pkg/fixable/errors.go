package fixable

import "errors"

var (
	ErrIdeaNotFound = &Error{
		Err:      errors.New("idea was not found"),
		AppCode:  "ERR_IDEA_NOT_FOUND",
		HTTPCode: 404,
		Fixes:    nil,
	}

	ErrWrongTicker = &Error{
		Err:      errors.New("instrument with the given ticker does not exist"),
		AppCode:  "ERR_WRONG_TICKER",
		HTTPCode: 404,
		Fixes:    nil,
	}
)
