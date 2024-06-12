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
	Cls ClassRegistry
	Va  VariantRegistry

	Input  <-chan string
	Output chan<- *ast.Rule

	UnknownVariants chan<- string
	UnknownClasses  chan<- string
	UnknownValues   chan<- string
}

func (p *Parser) Work() {
	defer close(p.Output)
	defer close(p.UnknownClasses)
	defer close(p.UnknownVariants)
	defer close(p.UnknownValues)

	for variantsClassValue := range p.Input {

		possibleVariants := strings.Split(variantsClassValue, ":")
		numVariants := len(possibleVariants)

		if numVariants == 0 {
			return
		}

		variants := make([]ApplyVariant, 0, numVariants-1)
		for _, v := range possibleVariants[:numVariants-1] {
			if vr, ok := p.Va.Find(v); ok {
				variants = append(variants, vr)
			} else {
				p.UnknownVariants <- variantsClassValue
			}
		}

		classValue := possibleVariants[numVariants-1]
		var class *Class
		var value string

		var found bool
		for end := len(classValue); end > 0; end-- {
			if cl, ok := p.Cls.Find(classValue[:end]); ok {
				class = cl
				value = classValue[min(end+1, len(classValue)-1):] // FIXME min -- костыль
				found = true
				break
			}
		}
		if !found {
			p.UnknownClasses <- variantsClassValue
			continue
		}

		if class.Name[0] == '-' {
			class.Name = class.Name[:len(class.Name)-1]
			value = "-" + value
		}

		value, ok := class.Val.Read(value)
		if !ok {
			if strings.HasPrefix(value, "[") && strings.HasSuffix(value, "]") {
				value = value[1 : len(value)-1]
			} else {
				p.UnknownValues <- value
				continue
			}
		}

		parsed := parsed{
			Original: variantsClassValue,
			Class:    class,
			Value:    value,
			Variants: variants,
		}
		p.Output <- parsed.ToRule()
	}
}
