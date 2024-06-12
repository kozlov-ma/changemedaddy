package css

import (
	"cssimpleme/ast"
	"strings"
)

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
	for variantsClassValue := range p.Input {

		possibleVariants := strings.Split(variantsClassValue, ":")
		numVariants := len(possibleVariants)

		if numVariants == 0 {
			return
		}

		variants := make([]ApplyVariant, 0, numVariants-1)
		for _, v := range possibleVariants[:numVariants-1] {
			if vr, ok := p.va.Find(v); ok {
				variants = append(variants, vr)
			} else {
				p.UnknownVariants <- v
			}
		}

		classValue := possibleVariants[numVariants-1]
		var class *Class
		var value string

		for end := len(classValue); end > 0; end-- {
			if cl, ok := p.cls.Find(classValue[:end]); ok {
				class = cl
				value = classValue[end:]
				break
			}
		}

		parsed := parsed{
			Class:    class,
			Value:    value,
			Variants: variants,
		}
		p.Output <- parsed.ToRule()
	}
}
