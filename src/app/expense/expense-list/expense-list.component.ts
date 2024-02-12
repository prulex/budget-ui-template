import { Component } from '@angular/core';
import { addMonths, set } from 'date-fns';
import { InfiniteScrollCustomEvent, ModalController, RefresherCustomEvent } from '@ionic/angular';
import { ExpenseModalComponent } from '../expense-modal/expense-modal.component';
import { CategoryCriteria, Expense, ExpenseUpsertDto, ExpenseCriteria, SortOption } from '../../shared/domain';
import { CategoryService } from '../../category/category.service';
import { ToastService } from '../../shared/service/toast.service';
import { finalize, from, groupBy, mergeMap, toArray } from 'rxjs';
import { formatPeriod } from '../../shared/period';
import { ExpenseService } from '../expense.service';
import { FormBuilder, FormGroup } from '@angular/forms';

interface ExpenseGroup {
  date: string;
  expenses: Expense[];
}
@Component({
  selector: 'app-expense-overview',
  templateUrl: './expense-list.component.html',
})
export class ExpenseListComponent {
  date = set(new Date(), { date: 1 });
  expenseGroups: ExpenseGroup[] | null = null;
  readonly initialSort = 'name,asc';
  lastPageReached = false;
  loading = false;
  readonly searchForm: FormGroup;
  searchCriteria: ExpenseCriteria = { page: 0, size: 25, sort: this.initialSort };

  readonly sortOptions: SortOption[] = [
    { label: 'Created at (newest first)', value: 'createdAt,desc' },
    { label: 'Created at (oldest first)', value: 'createdAt,asc' },
    { label: 'Date (newest first)', value: 'date,asc' },
    { label: 'Date (oldest first)', value: 'date,desc' },
    { label: 'Name (A-Z)', value: 'name,asc' },
    { label: 'Name (Z-A)', value: 'name,desc' },
  ];

  constructor(
    private readonly modalCtrl: ModalController,
    private readonly expenseService: ExpenseService,
    private readonly toastService: ToastService,
    private readonly formBuilder: FormBuilder,
  ) {
    this.searchForm = this.formBuilder.group({ name: [], sort: [this.initialSort] });
  }

  addMonths = (number: number): void => {
    this.date = addMonths(this.date, number);
  };
  ionViewDidEnter(): void {
    this.loadExpenses();
  }

  private loadExpenses(next: () => void = () => {}): void {
    this.searchCriteria.yearMonth = formatPeriod(this.date);
    if (!this.searchCriteria.categoryIds?.length) delete this.searchCriteria.categoryIds;
    if (!this.searchCriteria.name) delete this.searchCriteria.name;
    this.loading = true;
    const groupByDate = this.searchCriteria.sort.startsWith('date');
    this.expenseService
      .getExpense(this.searchCriteria)
      .pipe(
        finalize(() => (this.loading = false)),
        mergeMap((expensePage) => {
          this.lastPageReached = expensePage.last;
          next();
          if (this.searchCriteria.page === 0 || !this.expenseGroups) this.expenseGroups = [];
          return from(expensePage.content).pipe(
            groupBy((expense) => (groupByDate ? expense.date : expense.id)),
            mergeMap((group) => group.pipe(toArray())),
          );
        }),
      )
      .subscribe({
        next: (expenses: Expense[]) => {
          const expenseGroup: ExpenseGroup = {
            date: expenses[0].date,
            expenses: this.sortExpenses(expenses),
          };
          const expenseGroupWithSameDate = this.expenseGroups!.find((other) => other.date === expenseGroup.date);
          if (!expenseGroupWithSameDate || !groupByDate) this.expenseGroups!.push(expenseGroup);
          else
            expenseGroupWithSameDate.expenses = this.sortExpenses([
              ...expenseGroupWithSameDate.expenses,
              ...expenseGroup.expenses,
            ]);
        },
        error: (error) => this.toastService.displayErrorToast('Could not load expenses', error),
      });
  }

  private sortExpenses = (expenses: Expense[]): Expense[] => expenses.sort((a, b) => a.name.localeCompare(b.name));

  async openModal(expense?: Expense): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ExpenseModalComponent,
      componentProps: { expense: expense ? { ...expense } : {} },
    });
    modal.present();
    const { role } = await modal.onWillDismiss();
    console.log('role', role);
  }

  reloadExpense($event?: any): void {
    this.searchCriteria.page = 0;
    this.loadExpenses(() => ($event ? ($event as RefresherCustomEvent).target.complete() : {}));
  }

  loadNextExpensePage($event: any) {
    this.searchCriteria.page++;
    this.loadExpenses(() => ($event as InfiniteScrollCustomEvent).target.complete());
  }
  isSameMonth(dateString: string): boolean {
    const currentDate = this.date;
    const expenseDate = new Date(dateString);
    return currentDate.getFullYear() === expenseDate.getFullYear() && currentDate.getMonth() === expenseDate.getMonth();
  }
}
