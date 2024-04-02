package db

import "errors"

var (
	PositionDoesNotExistError = errors.New("position does not exist")

	IdeaDoesNotExistError = errors.New("idea with provided ID does not exist")
)
