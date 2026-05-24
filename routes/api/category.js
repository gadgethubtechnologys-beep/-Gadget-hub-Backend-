const express = require('express');
const router = express.Router();
const passport = require('passport');

// Bring in Models & Utils
const Category = require('../../models/category');
const auth = require('../../middleware/auth');
const role = require('../../middleware/role');
const store = require('../../utils/store');
const cloudinary = require('../../config/cloudinary');
const { ROLES } = require('../../constants');

router.post('/add', auth, role.check(ROLES.Admin), async (req, res) => {
  try {
    const { name, description, products, isActive, subCategories, image } = req.body;

    if (!description || !name) {
      return res.status(400).json({ error: 'You must enter description & name.' });
    }

    // Upload image to Cloudinary when base64 provided
    let imageUrl = null;
    if (image && typeof image === 'string' && image.startsWith('data:image')) {
      try {
        const upload = await cloudinary.uploader.upload(image, {
          folder: 'categories',
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }]
        });
        imageUrl = upload.secure_url;
      } catch (uploadErr) {
        console.error('Cloudinary upload error:', uploadErr.message || uploadErr);
        return res.status(400).json({ error: 'Image upload failed. Please try a smaller image or different format.' });
      }
    } else if (image && typeof image === 'string' && image.startsWith('http')) {
      // Already a URL (e.g. re-save)
      imageUrl = image;
    }

    // Create a safe unique slug derived from name
    const slugify = (s = '') =>
      s
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/(^-|-$)/g, '');

    const baseSlug = slugify(name || 'category');
    let candidateSlug = baseSlug || `cat-${Date.now().toString().slice(-4)}`;
    let i = 1;
    while (await Category.exists({ slug: candidateSlug })) {
      candidateSlug = `${baseSlug}-${i}`;
      i += 1;
    }

    const category = new Category({
      name,
      description,
      products,
      isActive,
      subCategories,
      image: imageUrl,
      slug: candidateSlug,
    });

    const data = await category.save();

    res.status(200).json({
      success: true,
      message: 'Category has been added successfully!',
      category: data
    });

  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ error: 'A category with a similar name/slug already exists. Please choose a different name.' });
    }
    console.error('Category add error:', err && err.message ? err.message : err);
    console.error('Category add stack:', err && err.stack ? err.stack : 'no stack');
    res.status(400).json({ error: 'Your request could not be processed. Please try again.' });
  }
});

// fetch store categories api
router.get('/list', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true });
    res.status(200).json({
      categories
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

// fetch categories api
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({});
    res.status(200).json({
      categories
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

// fetch category api
router.get('/:id', async (req, res) => {
  try {
    const categoryId = req.params.id;

    const categoryDoc = await Category.findOne({ _id: categoryId }).populate({
      path: 'products',
      select: 'name'
    });

    if (!categoryDoc) {
      return res.status(404).json({
        message: 'No Category found.'
      });
    }

    res.status(200).json({
      category: categoryDoc
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.put('/:id', auth, role.check(ROLES.Admin), async (req, res) => {
  try {
    const categoryId = req.params.id;
    const update = req.body.category;

    // Upload new image if base64 provided
    if (update.image && typeof update.image === 'string' && update.image.startsWith('data:image')) {
      try {
        const upload = await cloudinary.uploader.upload(update.image, {
          folder: 'categories',
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }]
        });
        update.image = upload.secure_url;
      } catch (uploadErr) {
        console.error('Cloudinary upload error (update):', uploadErr.message || uploadErr);
        return res.status(400).json({ error: 'Image upload failed. Please try a smaller image or different format.' });
      }
    }

    const { slug } = update;
    if (slug) {
      const foundCategory = await Category.findOne({ slug });
      if (foundCategory && foundCategory._id != categoryId) {
        return res.status(400).json({ error: 'Slug is already in use.' });
      }
    }

    const updatedCategory = await Category.findByIdAndUpdate(categoryId, update, { new: true });

    res.status(200).json({
      success: true,
      message: 'Category has been updated successfully!',
      category: updatedCategory
    });

  } catch (error) {
    console.error('Category update error:', error.message || error);
    res.status(400).json({ error: 'Your request could not be processed.' });
  }
});
router.put('/:id/active', auth, role.check(ROLES.Admin), async (req, res) => {
  try {
    const categoryId = req.params.id;
    const update = req.body.category;
    const query = { _id: categoryId };

    // disable category(categoryId) products
    if (!update.isActive) {
      const categoryDoc = await Category.findOne(
        { _id: categoryId, isActive: true },
        'products -_id'
      ).populate('products');

      store.disableProducts(categoryDoc.products);
    }

    await Category.findOneAndUpdate(query, update, {
      new: true
    });

    res.status(200).json({
      success: true,
      message: 'Category has been updated successfully!'
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.delete(
  '/delete/:id',
  auth,
  role.check(ROLES.Admin),
  async (req, res) => {
    try {
      const product = await Category.deleteOne({ _id: req.params.id });

      res.status(200).json({
        success: true,
        message: `Category has been deleted successfully!`,
        product
      });
    } catch (error) {
      res.status(400).json({
        error: 'Your request could not be processed. Please try again.'
      });
    }
  }
);

module.exports = router;
