import {
  AstBinaryOperation,
  AstUnaryOperation,
} from "@tact-lang/compiler/dist/grammar/ast";
import { Context, Expr, Arith, Bool } from "z3-solver";

/** Base class for symbolic expressions */
export abstract class SymExpr<T extends Expr> {
  abstract toZ3Expr(ctx: Context): T;
}

//
// Arithmetic Expressions
//

/** Base class for arithmetic expressions */
export abstract class SymArithExpr extends SymExpr<Arith> {}

/** Symbolic variable representing an integer */
export class SymVarArith extends SymArithExpr {
  name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  toZ3Expr(ctx: Context): Arith {
    return ctx.Int.const(this.name);
  }
}

/** Symbolic constant representing an integer value */
export class SymConstArith extends SymArithExpr {
  value: bigint;

  constructor(value: bigint) {
    super();
    this.value = value;
  }

  toZ3Expr(ctx: Context): Arith {
    return ctx.Int.val(this.value.toString());
  }
}

/** Symbolic arithmetic operation */
export class SymArithOp extends SymArithExpr {
  op: AstBinaryOperation;
  left: SymArithExpr;
  right: SymArithExpr;

  constructor(op: AstBinaryOperation, left: SymArithExpr, right: SymArithExpr) {
    super();
    this.op = op;
    this.left = left;
    this.right = right;
  }

  toZ3Expr(ctx: Context): Arith {
    const l = this.left.toZ3Expr(ctx);
    const r = this.right.toZ3Expr(ctx);
    switch (this.op) {
      case "+":
        return ctx.Sum(l, r);
      case "-":
        return ctx.Sub(l, r);
      case "*":
        return ctx.Product(l, r);
      case "/":
        return ctx.Div(l, r);
      case "%":
        return ctx.Mod(l, r);
      default:
        throw new Error(`Unsupported arithmetic operator: ${this.op}`);
    }
  }
}

/** Symbolic arithmetic unary operation */
export class SymArithUnaryOp extends SymArithExpr {
  op: AstUnaryOperation;
  operand: SymArithExpr;

  constructor(op: AstUnaryOperation, operand: SymArithExpr) {
    super();
    this.op = op;
    this.operand = operand;
  }

  toZ3Expr(ctx: Context): Arith {
    const o = this.operand.toZ3Expr(ctx);
    switch (this.op) {
      case "-":
        return ctx.Neg(o);
      default:
        throw new Error(`Unsupported unary operator: ${this.op}`);
    }
  }
}

//
// Boolean Expressions
//

/** Base class for boolean expressions */
export abstract class SymBoolExpr extends SymExpr<Bool> {}

/** Symbolic variable representing a boolean */
export class SymVarBool extends SymBoolExpr {
  name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  toZ3Expr(ctx: Context): Bool {
    return ctx.Bool.const(this.name);
  }
}

/** Symbolic constant representing a boolean value */
export class SymConstBool extends SymBoolExpr {
  value: boolean;

  constructor(value: boolean) {
    super();
    this.value = value;
  }

  toZ3Expr(ctx: Context): Bool {
    return ctx.Bool.val(this.value);
  }
}

/** Symbolic boolean operation */
export class SymBoolOp extends SymBoolExpr {
  op: AstBinaryOperation;
  left: SymExpr<any>;
  right: SymExpr<any>;

  constructor(op: AstBinaryOperation, left: SymExpr<any>, right: SymExpr<any>) {
    super();
    this.op = op;
    this.left = left;
    this.right = right;
  }

  toZ3Expr(ctx: Context): Bool {
    const l = this.left.toZ3Expr(ctx);
    const r = this.right.toZ3Expr(ctx);
    switch (this.op) {
      case "==":
        return ctx.Eq(l, r);
      case "!=":
        return ctx.Not(ctx.Eq(l, r));
      case ">":
        return ctx.GT(l as Arith, r as Arith);
      case ">=":
        return ctx.GE(l as Arith, r as Arith);
      case "<":
        return ctx.LT(l as Arith, r as Arith);
      case "<=":
        return ctx.LE(l as Arith, r as Arith);
      case "&&":
        return ctx.And(l as Bool, r as Bool);
      case "||":
        return ctx.Or(l as Bool, r as Bool);
      default:
        throw new Error(`Unsupported boolean operator: ${this.op}`);
    }
  }
}

/** Symbolic boolean unary operation */
export class SymBoolUnaryOp extends SymBoolExpr {
  op: AstUnaryOperation;
  operand: SymBoolExpr;

  constructor(op: AstUnaryOperation, operand: SymBoolExpr) {
    super();
    this.op = op;
    this.operand = operand;
  }

  toZ3Expr(ctx: Context): Bool {
    const o = this.operand.toZ3Expr(ctx);
    switch (this.op) {
      case "!":
        return ctx.Not(o);
      default:
        throw new Error(`Unsupported unary operator: ${this.op}`);
    }
  }
}
