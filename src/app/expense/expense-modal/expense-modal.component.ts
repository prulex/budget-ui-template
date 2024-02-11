import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { filter, finalize, from } from 'rxjs';
import { CategoryModalComponent } from '../../category/category-modal/category-modal.component';
import { ActionSheetService } from '../../shared/service/action-sheet.service';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { ExpenseService } from '../expense.service';
import { ToastService } from '../../shared/service/toast.service';
import { formatISO, parseISO } from 'date-fns';
import { Category } from '../../shared/domain';
import { CategoryService } from '../../category/category.service';
@Component({
  selector: 'app-expense-modal',
  templateUrl: './expense-modal.component.html',
})
export class ExpenseModalComponent {
  readonly expenseForm: FormGroup;
  categories: Category[] | null = null;
  submitting = false;
  categoriesLoaded: boolean = false;
  constructor(
    private readonly expenseService: ExpenseService,
    private readonly actionSheetService: ActionSheetService,
    private readonly modalCtrl: ModalController,
    private readonly formBuilder: FormBuilder,
    private readonly toastService: ToastService,
    private readonly categoryService: CategoryService,
  ) {
    this.expenseForm = this.formBuilder.group({
      id: ['', [Validators.required, Validators.maxLength(40)]],
      amount: ['', [Validators.required, Validators.maxLength(40), Validators.pattern(/^[0-9]+$/)]],
      categoryId: ['', [Validators.required, Validators.maxLength(40)]],
      date: new FormControl(formatISO(new Date())),
      name: ['', [Validators.required, Validators.maxLength(40)]],
    });
  }

  ionViewWillEnter(): void {
    this.loadAllCategories();
  }
  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save(): void {
    this.submitting = true;
    this.expenseService
      .upsertExpense(this.expenseForm.value, {
        date: formatISO(parseISO(this.expenseForm.value.date), { representation: 'date' }),
      })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: () => {
          this.toastService.displaySuccessToast('Category saved');
          this.modalCtrl.dismiss(null, 'refresh');
        },
        error: (error) => this.toastService.displayErrorToast('Could not save category', error),
      });
  }

  delete(): void {
    from(this.actionSheetService.showDeletionConfirmation('Are you sure you want to delete this expense?'))
      .pipe(filter((action) => action === 'delete'))
      .subscribe(() => this.modalCtrl.dismiss(null, 'delete'));
  }

  loadAllCategories(): void {
    this.categoryService.getAllCategories({ sort: 'name,asc' }).subscribe({
      next: (categories) => {
        this.categories = categories;
        this.categoriesLoaded = true;
      },
      error: (error) => this.toastService.displayErrorToast('Could not load categories', error),
    });
  }
  async showCategoryModal(): Promise<void> {
    const categoryModal = await this.modalCtrl.create({ component: CategoryModalComponent });
    await categoryModal.present();
    const { role } = await categoryModal.onWillDismiss();
    console.log('role', role);
  }
}
