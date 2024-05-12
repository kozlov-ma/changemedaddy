package api

import (
	"github.com/labstack/echo/v4"
)

func (h *handler) adminMW(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		a, err := c.Cookie("is_admin")
		if err != nil || a == nil {
			writeCookie(c, "is_admin", "false")
			c.Set("is_admin", false)
			return next(c)
		}
		if a.Value == "true" {
			writeCookie(c, "is_admin", "иди нахуй")
			c.Set("is_admin", false)
			return next(c)
		}
		if a.Value != "pavel shemetov, fuck me~" {
			writeCookie(c, "is_admin", "false")
			c.Set("is_admin", false)
			return next(c)
		}

		c.Set("is_admin", true)

		return next(c)
	}
}

func (h *handler) adminonlyMW(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		isAdmin, _ := c.Get("is_admin").(bool)
		if !isAdmin {
			return c.Redirect(307, "/401")
		}

		return next(c)
	}
}

func (h *handler) makeAdmin(c echo.Context) error {
	if c.Param("password") == "k4k4y4_5p1d_app" {
		writeCookie(c, "is_admin", "pavel shemetov, fuck me~")
		return c.String(200, "Course{sp3rma}")
	}

	return c.Redirect(307, "https://cp.beget.com/shared/Dyzmia-zY3oLclceXSit1AebJt54ariX/joomla3.png")
}
