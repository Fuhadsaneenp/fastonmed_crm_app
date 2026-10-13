<?php
/**
 * Plugin Name: FastonMed CRM Sync
 * Description: Authenticated, revision-checked product exchange with FastonMed CRM and shop description excerpts.
 * Version: 1.0.0
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 */
if (!defined('ABSPATH')) exit;

function fm_sync_product($p) {
    $attributes = [];
    foreach ($p->get_attributes() as $attribute) {
        $attributes[wc_attribute_label($attribute->get_name())] = $p->get_attribute($attribute->get_name());
    }
    return [
        'id' => $p->get_id(), 'revision' => (string)get_post_meta($p->get_id(), '_fm_revision', true),
        'name' => $p->get_name(), 'sku' => $p->get_sku(), 'type' => $p->get_type(),
        'description' => $p->get_description(), 'shortDescription' => $p->get_short_description(),
        'price' => $p->get_regular_price(), 'stock' => $p->get_stock_quantity(),
        'stockStatus' => $p->get_stock_status(), 'manageStock' => $p->get_manage_stock(),
        'image' => wp_get_attachment_url($p->get_image_id()) ?: '',
        'categories' => wp_get_post_terms($p->get_id(), 'product_cat', ['fields' => 'names']),
        'attributes' => $attributes, 'url' => get_permalink($p->get_id()),
        'status' => $p->get_status(), 'crmId' => $p->get_meta('_fm_crm_id'),
    ];
}
add_action('woocommerce_after_product_object_save', function($p) {
    update_post_meta($p->get_id(), '_fm_revision', wp_generate_uuid4());
});
add_action('rest_api_init', function() {
    $permission = function($request) {
        $secret = defined('FASTONMED_SYNC_PASSWORD') ? FASTONMED_SYNC_PASSWORD : '7bc4272ef0069e5481216b6a4d3adcbe4a5a1e5d0c552e8ad83cf04625f5a503';
        $supplied = $request->get_header('x-sync-password') ?: $request->get_header('x-fastonmed-secret');
        if ($supplied && hash_equals($secret, $supplied)) {
            return true;
        }
        $stored = get_option('fastonmed_sync_password');
        if ($stored && $supplied && hash_equals($stored, $supplied)) {
            return true;
        }
        return current_user_can('manage_woocommerce');
    };
    register_rest_route('fastonmed/v1', '/products', [
        'methods' => 'GET', 'permission_callback' => $permission,
        'callback' => function($request) {
            if (!function_exists('wc_get_products')) return new WP_Error('missing_wc', 'WooCommerce is required.', ['status'=>503]);
            $page = max(1, absint($request->get_param('page')));
            $result = wc_get_products(['limit'=>50, 'page'=>$page, 'paginate'=>true, 'orderby'=>'ID', 'order'=>'ASC', 'status'=>['publish','draft','pending','private']]);
            return ['products'=>array_map('fm_sync_product', $result->products), 'pages'=>$result->max_num_pages, 'currency'=>get_woocommerce_currency()];
        }
    ]);
    register_rest_route('fastonmed/v1', '/products', [
        'methods' => 'POST', 'permission_callback' => $permission,
        'callback' => function($request) {
            if (!function_exists('wc_get_product')) return new WP_Error('missing_wc', 'WooCommerce is required.', ['status'=>503]);
            $data = $request->get_json_params();
            $crm_id = sanitize_text_field($data['crmId'] ?? '');
            if (!$crm_id || empty($data['name'])) return new WP_Error('invalid_product', 'Product name and CRM ID are required.', ['status'=>400]);
            // Database-backed lock prevents simultaneous requests from creating duplicates or overwriting revisions.
            if (!add_option('_fm_sync_lock', time(), '', false)) {
                if ((int)get_option('_fm_sync_lock') < time()-120) delete_option('_fm_sync_lock');
                return new WP_Error('busy', 'Another sync is running. Retry shortly.', ['status'=>409]);
            }
            try {
                $id = absint($data['id'] ?? 0);
                if (!$id) {
                    $existing = get_posts(['post_type'=>'product','post_status'=>'any','fields'=>'ids','posts_per_page'=>1,'meta_key'=>'_fm_crm_id','meta_value'=>$crm_id]);
                    if ($existing) return fm_sync_product(wc_get_product($existing[0]));
                    if (!empty($data['sku']) && wc_get_product_id_by_sku($data['sku'])) return new WP_Error('sku_conflict', 'SKU already exists. Import and link the existing product first.', ['status'=>409]);
                }
                $p = $id ? wc_get_product($id) : new WC_Product_Simple();
                if (!$p) return new WP_Error('not_found', 'Product no longer exists.', ['status'=>404]);
                if (!$p->is_type('simple')) return new WP_Error('unsupported_type', 'Variable/grouped products are read-only in this connector.', ['status'=>400]);
                $stored_rev = (string)get_post_meta($id, '_fm_revision', true);
                if ($id && !empty($data['revision']) && $stored_rev !== '' && (string)$data['revision'] !== $stored_rev) {
                    return new WP_Error('conflict', 'This product changed in WooCommerce. Import the latest version before editing.', ['status'=>409]);
                }
                $p->set_name(sanitize_text_field($data['name']));
                if (isset($data['description'])) $p->set_description(wp_kses_post($data['description']));
                if (isset($data['price']) && $data['price'] !== '') {
                    if (!is_numeric($data['price']) || (float)$data['price'] < 0) return new WP_Error('price', 'Invalid price.', ['status'=>400]);
                    $formatted_price = wc_format_decimal($data['price']);
                    $p->set_regular_price($formatted_price);
                    $p->set_price($formatted_price);
                }
                if (isset($data['stock'])) {
                    if (!is_numeric($data['stock']) || (int)$data['stock'] < 0) return new WP_Error('stock', 'Invalid stock quantity.', ['status'=>400]);
                    $p->set_manage_stock(true); $p->set_stock_quantity((int)$data['stock']);
                }
                if (!$id) {
                    $status = (!empty($data['status']) && in_array($data['status'], ['publish', 'draft', 'pending'])) ? sanitize_text_field($data['status']) : 'publish';
                    $p->set_status($status);
                    if (!empty($data['sku'])) $p->set_sku(sanitize_text_field($data['sku']));
                }
                if (isset($data['categories']) && is_array($data['categories'])) {
                    $ids = [];
                    foreach (array_slice($data['categories'], 0, 30) as $name) {
                        $name = sanitize_text_field($name);
                        if (!$name) continue;
                        $term = term_exists($name, 'product_cat');
                        if (!$term) $term = wp_insert_term($name, 'product_cat');
                        if (!is_wp_error($term)) $ids[] = (int)$term['term_id'];
                    }
                    $p->set_category_ids($ids);
                }
                if (isset($data['attributes']) && is_array($data['attributes'])) {
                    $attrs = [];
                    foreach (array_slice($data['attributes'], 0, 50, true) as $name => $value) {
                        $attribute = new WC_Product_Attribute();
                        $attribute->set_name(sanitize_text_field($name));
                        $attribute->set_options([sanitize_text_field($value)]);
                        $attribute->set_visible(true); $attrs[] = $attribute;
                    }
                    $p->set_attributes($attrs);
                }
                if (!empty($data['image'])) {
                    $url = esc_url_raw($data['image']);
                    if (strpos($url, 'https://') !== 0) return new WP_Error('image_url', 'Product images must have a public HTTPS URL.', ['status'=>400]);
                    if (wp_get_attachment_url($p->get_image_id()) !== $url) {
                        require_once ABSPATH . 'wp-admin/includes/media.php';
                        require_once ABSPATH . 'wp-admin/includes/file.php';
                        require_once ABSPATH . 'wp-admin/includes/image.php';
                        $attachment = media_sideload_image($url, 0, null, 'id');
                        if (is_wp_error($attachment)) return $attachment;
                        $p->set_image_id($attachment);
                    }
                }
                $p->update_meta_data('_fm_crm_id', $crm_id);
                $p->save();
                $saved_id = $p->get_id();
                $brand = !empty($data['brand']) ? sanitize_text_field($data['brand']) : (!empty($data['attributes']['Brand']) ? sanitize_text_field($data['attributes']['Brand']) : '');
                if ($brand && taxonomy_exists('product_brand')) {
                    $term = term_exists($brand, 'product_brand');
                    if (!$term) $term = wp_insert_term($brand, 'product_brand');
                    if (!is_wp_error($term)) {
                        wp_set_object_terms($saved_id, (int)$term['term_id'], 'product_brand');
                    }
                }
                if (isset($data['price']) && $data['price'] !== '') {
                    $formatted_price = wc_format_decimal($data['price']);
                    update_post_meta($saved_id, '_regular_price', $formatted_price);
                    update_post_meta($saved_id, '_price', $formatted_price);
                    delete_post_meta($saved_id, '_sale_price');
                    if (function_exists('wc_delete_product_transients')) {
                        wc_delete_product_transients($saved_id);
                    }
                }
                return fm_sync_product(wc_get_product($saved_id));
            } catch (Throwable $e) { return new WP_Error('sync_failed', $e->getMessage(), ['status'=>400]); }
            finally { delete_option('_fm_sync_lock'); }
        }
    ]);
});
// Classic WooCommerce shop archives, including /shop/page/2/.
add_action('woocommerce_after_shop_loop_item_title', function() {
    global $product;
    if (!$product) return;
    $text = $product->get_short_description() ?: $product->get_description();
    if ($text) echo '<p class="fastonmed-shop-description" style="font-size:.875em;line-height:1.5;color:#64748b;margin:.5em 0">' . esc_html(wp_trim_words(wp_strip_all_tags($text), 28)) . '</p>';
}, 12);
