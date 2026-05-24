const express = require('express');
const router = express.Router();

const Product = require('../../models/product');
const Category = require('../../models/category');
const auth = require('../../middleware/auth');
const role = require('../../middleware/role');
const { ROLES } = require('../../constants');
const cloudinary = require('../../config/cloudinary');

// GET all products (admin)
// router.get('/', async (req, res) => {
//   try {
//     const products = await Product.find({}).populate('category', 'name');
//     res.status(200).json({ products });
//   } catch (error) {
//     res.status(400).json({ error: 'Your request could not be processed. Please try again.' });
//   }
// });
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    // support both ?page= and ?skip= from different clients
    const skip = req.query.skip !== undefined
      ? parseInt(req.query.skip)
      : ((parseInt(req.query.page) || 1) - 1) * limit;

    // Build filter object
    const filter = {};
    
    // Filter by category if provided
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const products = await Product.find(filter)
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .limit(limit)
      .skip(skip);

    res.status(200).json({ products });
  } catch (error) {
    res.status(400).json({ error: 'Error fetching products' });
  }
});
// GET product by slug (public storefront) - MUST come before /:id
router.get('/item/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true })
      .populate('category', 'name')
      .populate('subcategory', 'name');
    if (!product) return res.status(404).json({ message: 'No product found.' });
    res.status(200).json({ product });
  } catch (error) {
    res.status(400).json({ error: 'Your request could not be processed. Please try again.' });
  }
});

// POST add product with variants
// router.post('/add', auth, role.check(ROLES.Admin, ROLES.Merchant, ROLES.Member), async (req, res) => {
//   try {
//     const { name, description, category, variants } = req.body;

//     if (!name || !description) {
//       return res.status(400).json({ error: 'Name and description are required.' });
//     }

//     if (!variants || !Array.isArray(variants) || variants.length === 0) {
//       return res.status(400).json({ error: 'At least one variant is required.' });
//     }

//     // Validate variants
//     const colors = variants.map(v => v.color?.toLowerCase());
//     const uniqueColors = new Set(colors);
//     if (uniqueColors.size !== colors.length) {
//       return res.status(400).json({ error: 'Each variant must have a unique color.' });
//     }

//     for (const v of variants) {
//       if (!v.color) return res.status(400).json({ error: 'Each variant must have a color.' });
//       if (!v.price || Number(v.price) <= 0) return res.status(400).json({ error: 'Each variant price must be greater than 0.' });
//     }

//     // Ensure exactly one default variant
//     const defaultCount = variants.filter(v => v.isDefault).length;
//     if (defaultCount === 0) variants[0].isDefault = true;
//     if (defaultCount > 1) variants.forEach((v, i) => { v.isDefault = i === 0; });

//     const product = new Product({ name, description, category: category || null, variants });
//     const saved = await product.save();

//     // Link product to category
//     if (category) {
//       await Category.findByIdAndUpdate(category, { $push: { products: saved._id } });
//     }

//     res.status(200).json({ success: true, message: 'Product added successfully!', product: saved });
//   } catch (error) {
//     console.error(error);
//     res.status(400).json({ error: 'Your request could not be processed. Please try again.' });
//   }
// });

router.post('/add', auth, role.check(ROLES.Admin, ROLES.Merchant, ROLES.Member), async (req, res) => {
  try {
    const { name, description, category, subcategory, variants } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required.' });
    }

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: 'At least one variant is required.' });
    }

    // Upload images array to Cloudinary
    const updatedVariants = [];
    for (const v of variants) {
      const uploadedImages = [];
      const imgs = Array.isArray(v.images) ? v.images : [];
      for (const img of imgs) {
        if (img && img.startsWith('data:image')) {
          const upload = await cloudinary.uploader.upload(img, { folder: 'products' });
          uploadedImages.push(upload.secure_url);
        } else if (img) {
          uploadedImages.push(img);
        }
      }
      updatedVariants.push({ ...v, images: uploadedImages });
    }

    // Ensure one default
    if (!updatedVariants.some(v => v.isDefault)) updatedVariants[0].isDefault = true;

    const product = new Product({
      name,
      description,
      category: category || null,
      subcategory: subcategory || null,
      variants: updatedVariants
    });

    const saved = await product.save();

    if (category) {
      await Category.findByIdAndUpdate(category, { $push: { products: saved._id } });
    }

    res.status(200).json({
      success: true,
      message: 'Product added successfully!',
      product: saved
    });

  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Your request could not be processed. Please try again.' });
  }
});
// PUT update product
router.put('/update/:id', auth, role.check(ROLES.Admin, ROLES.Merchant, ROLES.Member), async (req, res) => {
  try {
    const { name, description, category, subcategory, variants, isActive } = req.body;

    if (variants) {
      const colors = variants.map(v => v.color?.toLowerCase());
      if (new Set(colors).size !== colors.length) {
        return res.status(400).json({ error: 'Each variant must have a unique color.' });
      }
      const defaultCount = variants.filter(v => v.isDefault).length;
      if (defaultCount === 0) variants[0].isDefault = true;
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (category !== undefined) product.category = category || null;
    if (subcategory !== undefined) product.subcategory = subcategory || null;
    if (isActive !== undefined) product.isActive = isActive;
    // if (variants !== undefined) product.variants = variants;
    if (variants !== undefined) {
      const updatedVariants = [];
      for (const v of variants) {
        const uploadedImages = [];
        const imgs = Array.isArray(v.images) ? v.images : [];
        for (const img of imgs) {
          if (img && img.startsWith('data:image')) {
            const upload = await cloudinary.uploader.upload(img, { folder: 'products' });
            uploadedImages.push(upload.secure_url);
          } else if (img) {
            uploadedImages.push(img);
          }
        }
        updatedVariants.push({ ...v, images: uploadedImages });
      }
      if (!updatedVariants.some(v => v.isDefault)) updatedVariants[0].isDefault = true;
      product.variants = updatedVariants;
    }
    product.updated = new Date();

    const updated = await product.save();

    res.status(200).json({ success: true, message: 'Product updated successfully!', product: updated });
  } catch (error) {
    res.status(400).json({ error: 'Your request could not be processed. Please try again.' });
  }
});

// DELETE product
router.delete('/delete/:id', auth, role.check(ROLES.Admin, ROLES.Merchant, ROLES.Member), async (req, res) => {
  try {
    await Product.deleteOne({ _id: req.params.id });
    res.status(200).json({ success: true, message: 'Product deleted successfully!' });
  } catch (error) {
    res.status(400).json({ error: 'Your request could not be processed. Please try again.' });
  }
});

// POST upload single image to Cloudinary
router.post('/image/upload', auth, role.check(ROLES.Admin, ROLES.Merchant, ROLES.Member), async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image data is required.' });
    if (!image.startsWith('data:image')) {
      return res.status(400).json({ error: 'Invalid image format. Must be base64 data URI.' });
    }
    const upload = await cloudinary.uploader.upload(image, { folder: 'products' });
    res.status(200).json({ success: true, imageUrl: upload.secure_url });
  } catch (error) {
    console.error('Error uploading image to Cloudinary:', error);
    res.status(400).json({ error: 'Failed to upload image. Please try again.' });
  }
});

// DELETE single image from Cloudinary by URL
router.post('/image/delete', auth, role.check(ROLES.Admin, ROLES.Merchant, ROLES.Member), async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Image url is required.' });

    // Parse public_id from Cloudinary URL: remove version and extension
    // e.g. https://res.cloudinary.com/<cloud>/image/upload/v12345/folder/name.jpg
    const parts = url.split('/');
    const uploadIndex = parts.findIndex(p => p === 'upload');
    if (uploadIndex === -1) return res.status(400).json({ error: 'Invalid cloudinary url.' });
    let publicParts = parts.slice(uploadIndex + 1).join('/');
    // remove version prefix like v12345/
    publicParts = publicParts.replace(/^v\d+\//, '');
    // strip extension
    const publicId = publicParts.replace(/\.[^/.]+$/, '');

    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result === 'not found') {
      return res.status(404).json({ error: 'Image not found on Cloudinary.' });
    }
    res.status(200).json({ success: true, message: 'Image deleted from Cloudinary.' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(400).json({ error: 'Failed to delete image.' });
  }
});

// GET single product by id (admin) - MUST be last to avoid shadowing other /:id routes
router.get('/:id',async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name')
      .populate('subcategory', 'name');
    if (!product) return res.status(404).json({ message: 'No product found.' });
    res.status(200).json({ product });
  } catch (error) {
    res.status(400).json({ error: 'Your request could not be processed. Please try again.' });
  }
});

module.exports = router;
