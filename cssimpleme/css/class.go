package css

import "cssimpleme/ast"

type ValueReader interface {
	Read(fromCls string) (converted string, ok bool)
}

type ValueHandler func(value string) ast.AST

type Class struct {
	Name   string
	Val    ValueReader
	Handle ValueHandler
}

type noValue struct{}

func (n noValue) Read(fromCls string) (converted string, ok bool) {
	return "", fromCls == ""
}

var NoValue = noValue{}
