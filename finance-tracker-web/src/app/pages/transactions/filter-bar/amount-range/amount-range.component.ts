import { Component, input } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormGroupDirective,
  NgForm,
  ReactiveFormsModule,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/** The amount range filter's controls (text as typed, "12,50"). */
export type AmountRangeGroup = FormGroup<{ min: FormControl<string>; max: FormControl<string> }>;

/** Shows the maximum amount as invalid while the range is reversed (a group error). */
class AmountRangeErrorMatcher implements ErrorStateMatcher {
  isErrorState(control: AbstractControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const shown = !!control && (control.touched || control.dirty || !!form?.submitted);
    return shown && (control.invalid || !!control.parent?.hasError('amountRangeReversed'));
  }
}

/** "Min amount" and "Max amount" fields of the transactions filter, with their messages. */
@Component({
  selector: 'app-amount-range',
  imports: [MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <mat-form-field subscriptSizing="dynamic">
      <mat-label i18n="@@transactions.filter.minAmount">Min amount</mat-label>
      <input matInput inputmode="decimal" autocomplete="off" [formControl]="group().controls.min" />
      <span matTextSuffix>&nbsp;zł</span>
      @let min = group().controls.min;
      @if (min.hasError('amountInvalid')) {
        <mat-error i18n="@@common.amount.invalid">Enter a valid amount.</mat-error>
      } @else if (min.hasError('amountNegative')) {
        <mat-error i18n="@@transactions.filter.amount.negative"
          >Enter an amount of 0 or more.</mat-error
        >
      } @else if (min.hasError('amountDecimals')) {
        <mat-error i18n="@@common.amount.tooManyDecimals"
          >Enter an amount with at most 2 decimal places.</mat-error
        >
      } @else if (min.hasError('amountTooLarge')) {
        <mat-error i18n="@@common.amount.tooLarge">Enter a smaller amount.</mat-error>
      }
    </mat-form-field>

    <mat-form-field subscriptSizing="dynamic">
      <mat-label i18n="@@transactions.filter.maxAmount">Max amount</mat-label>
      <input
        matInput
        inputmode="decimal"
        autocomplete="off"
        [formControl]="group().controls.max"
        [errorStateMatcher]="rangeMatcher"
      />
      <span matTextSuffix>&nbsp;zł</span>
      @let max = group().controls.max;
      @if (max.hasError('amountInvalid')) {
        <mat-error i18n="@@common.amount.invalid">Enter a valid amount.</mat-error>
      } @else if (max.hasError('amountNegative')) {
        <mat-error i18n="@@transactions.filter.amount.negative"
          >Enter an amount of 0 or more.</mat-error
        >
      } @else if (max.hasError('amountDecimals')) {
        <mat-error i18n="@@common.amount.tooManyDecimals"
          >Enter an amount with at most 2 decimal places.</mat-error
        >
      } @else if (max.hasError('amountTooLarge')) {
        <mat-error i18n="@@common.amount.tooLarge">Enter a smaller amount.</mat-error>
      } @else if (group().hasError('amountRangeReversed')) {
        <mat-error i18n="@@transactions.filter.amount.reversed"
          >Maximum amount can't be less than minimum amount.</mat-error
        >
      }
    </mat-form-field>
  `,
  styles: `
    :host {
      display: contents;
    }

    mat-form-field {
      width: 100%;
    }
  `,
})
export class AmountRangeComponent {
  readonly group = input.required<AmountRangeGroup>();

  protected readonly rangeMatcher = new AmountRangeErrorMatcher();
}
