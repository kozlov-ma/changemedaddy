package db

import "errors"

var (
	PositionDoesNotExistError  = errors.New("position does not exist")
	CannotCreatePositionsError = errors.New("creating new positions in existing idea is prohibited")

	IdeaDoesNotExistError = errors.New("idea with provided ID does not exist")
)
