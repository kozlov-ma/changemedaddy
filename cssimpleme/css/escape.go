package css

import (
	"fmt"
	"strings"
	"unicode"
)

func Escape(value string) string {
	if value == "" {
		return ""
	}

	var result strings.Builder
	length := len(value)
	firstCodeUnit := rune(value[0])

	if length == 1 && firstCodeUnit == '-' {
		return "\\" + value
	}

	for index, codeUnit := range value {
		if codeUnit == '\x00' {
			result.WriteString("\uFFFD")
		} else if (codeUnit >= '\x01' && codeUnit <= '\x1F') || codeUnit == '\x7F' ||
			(index == 0 && unicode.IsDigit(codeUnit)) ||
			(index == 1 && unicode.IsDigit(codeUnit) && firstCodeUnit == '-') {
			result.WriteString(fmt.Sprintf("\\%X ", codeUnit))
		} else if codeUnit >= '\u0080' || codeUnit == '-' || codeUnit == '_' ||
			unicode.IsDigit(codeUnit) || unicode.IsLetter(codeUnit) {
			result.WriteRune(codeUnit)
		} else {
			result.WriteString("\\" + string(codeUnit))
		}
	}

	return result.String()
}
