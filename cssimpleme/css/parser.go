package css

import "cssimpleme/ast"

type ClassRegistry interface {
	Find(name string) (cls *Class, ok bool)
}

type VariantRegistry interface {
	Find(name string) (av ApplyVariant, ok bool)
}

type Parser struct {
	cls ClassRegistry
	va  VariantRegistry

	Input  <-chan string
	Output chan<- *ast.Rule

	UnknownVariants chan<- string
	UnknownClasses  chan<- string
}

func (p *Parser) Work() {
	panic("implement me")
}
