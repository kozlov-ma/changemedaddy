package analyst

import "errors"

var (
	ErrNotFound      = errors.New("analyst does not exist")
	ErrDuplicateName = errors.New("analyst with this name already exists")
	ErrWrongToken    = errors.New("wrong token")

	ErrNameTooShort = errors.New("this name is too short")
	ErrNameTooLong  = errors.New("this name is too long")
)
