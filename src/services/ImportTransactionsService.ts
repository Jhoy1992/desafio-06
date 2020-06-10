import { getRepository, getCustomRepository, In } from 'typeorm';
import path from 'path';
import fs from 'fs';
import uploadConfig from '../config/upload';
import csv from '../lib/csv';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import CategoriesRepository from '../repositories/CategoriesRepository';

interface Request {
  csvFilename: string;
}

interface NewTransaction {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class ImportTransactionsService {
  async execute({ csvFilename }: Request): Promise<Transaction[]> {
    const transactionsRepository = getRepository(Transaction);
    const categoriesRepository = getCustomRepository(CategoriesRepository);

    const csvFilePath = path.join(uploadConfig.directory, csvFilename);
    const transactionsArray = await csv.loadCSV(csvFilePath);
    await fs.promises.unlink(csvFilePath);

    const transactions: NewTransaction[] = [];
    const categories: string[] = [];

    transactionsArray.map(transaction => {
      const [title, type, value, category] = transaction;

      if (!title || !type || !value || !category) return;

      transactions.push({
        title,
        value: Number(value),
        type: type as 'income' | 'outcome',
        category,
      });

      categories.push(category);
    });

    const existentCategories = await categoriesRepository.find({
      where: { title: In(categories) },
    });

    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    const allCategories = [...existentCategories, ...newCategories];

    await categoriesRepository.save(newCategories);

    const newTransactions = transactionsRepository.create(
      transactions.map(transaction => {
        const { title, type, value, category } = transaction;

        const findCategory = allCategories.find(
          categoryItem => categoryItem.title === category,
        );

        return { title, type, value, category_id: findCategory?.id };
      }),
    );

    await transactionsRepository.save(newTransactions);

    return newTransactions;
  }
}

export default ImportTransactionsService;
