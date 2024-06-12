package tw

import (
	"strings"
)

type arbReader struct{}

func (a arbReader) Read(fromCls string) (converted string, ok bool) {
	if strings.HasPrefix(fromCls, "[") && strings.HasSuffix(fromCls, "]") {
		return strings.Trim(fromCls, "[]"), ok
	}

	return "", false
}

var arb = arbReader{}

func init() {

}
