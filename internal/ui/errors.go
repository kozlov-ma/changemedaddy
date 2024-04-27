package ui

import (
	_ "embed"

	"github.com/labstack/echo/v4"
)

//go:embed template/404.html
var s_404Template string
var err404Template = mustTemplate(s_404Template)

//go:embed template/500.html
var s_500Template string
var err500Template = mustTemplate(s_500Template)

func Render404(c echo.Context) error {
	return err404Template.Execute(c.Response().Writer, nil)
}

func Render500(c echo.Context) error {
	return err500Template.Execute(c.Response().Writer, nil)
}
