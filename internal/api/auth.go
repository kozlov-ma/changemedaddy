package api

import (
	"changemedaddy/internal/aggregate/analyst"
	"changemedaddy/internal/pkg/assert"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

func writeCookie(c echo.Context, name, value string) {
	cookie := new(http.Cookie)
	cookie.Name = name
	cookie.Value = value
	cookie.Expires = time.Now().Add(100 * 24 * 365 * time.Hour)
	cookie.Path = "/"
	c.SetCookie(cookie)
}

func (h *handler) tokenAuth(c echo.Context) error {
	token := c.Param("token")
	if token == "" {
		h.log.Debug("user tried logging in with empty token")
		return c.Redirect(307, "/wrongtoken")
	}

	a, err := h.as.Auth(c.Request().Context(), token)
	if errors.Is(err, analyst.ErrWrongToken) {
		h.log.Debug("user tried logging in with wrong token", "token", token)
		return c.Redirect(307, "/wrongtoken")
	}

	if err != nil {
		h.log.Error("couldn't authenticate user", "token", token, "err", err)
	}

	writeCookie(c, "token", token)

	return c.Redirect(302, fmt.Sprintf("/analyst/%s", a.Slug))
}

func (h *handler) ownerMW(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		author, ok := c.Get("analyst").(*analyst.Analyst)
		assert.That(ok, "analyst not found in ownerMW context")

		cookie, err := c.Cookie("token")
		if err != nil {
			h.log.Debug("user tried logging in without token", "err", err, "cookies", c.Cookies())
			return c.Redirect(307, "/wrongtoken")
		}

		token := cookie.Value
		user, err := h.as.Auth(c.Request().Context(), token)
		if errors.Is(err, analyst.ErrWrongToken) {
			h.log.Info("user tried logging in with wrong token", "token", token)
			return c.Redirect(307, "/wrongtoken")
		} else if err != nil {
			h.log.Error("couldn't authenticate user", "token", token, "err", err)
			return c.Redirect(307, "/500")
		}

		c.Set("isOwner", user.ID == author.ID)

		return next(c)
	}
}

func (h *handler) onlyOwnerMW(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		isOwner, ok := c.Get("isOwner").(bool)
		assert.That(ok, "isOwner not found in onlyOwnerMW context")

		if !isOwner {
			return c.Redirect(307, "/401")
		}

		return next(c)
	}
}
