package css

import "cssimpleme/ast"

type ValueReader interface {
	Read(fromCls string) (converted string, ok bool)
}

type ValueHandler func(value string) *ast.Rule

type Class struct {
	Name   string
	Val    ValueReader
	Handle ValueHandler
}
