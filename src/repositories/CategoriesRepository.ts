import { EntityRepository, Repository } from 'typeorm';

import Category from '../models/Category';

@EntityRepository(Category)
class CategoriesRepository extends Repository<Category> {
  public async findOrCreate(title: string): Promise<Category> {
    const checkExistsCategory = await this.findOne({ where: { title } });

    if (checkExistsCategory) {
      return checkExistsCategory;
    }

    const newCategory = await this.create({
      title,
    });

    await this.save(newCategory);

    return newCategory;
  }
}

export default CategoriesRepository;
