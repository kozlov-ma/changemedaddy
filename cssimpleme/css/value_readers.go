package css

import (
	"strconv"
)

type noValue struct{}

func (n noValue) Read(fromCls string) (converted string, ok bool) {
	return "", true
}

var NoValue = noValue{}

type rem struct{}

func (r rem) Read(fromCls string) (converted string, ok bool) {
	i, err := strconv.Atoi(fromCls)
	if err != nil {
		return "", false
	}

	return strconv.FormatFloat(float64(i)/4, 'f', 3, 64) + "rem", true
}

var Rem = rem{}
