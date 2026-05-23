import { query } from '../db/client';

export const toolDefinitions = [
  {
    type: 'function' as const,
    function: {
      name: 'get_product_info',
      description:
        'Search for product information by name or keyword. Use this when the user asks about products, prices, stock, or specifications.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Product name or search keyword' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_order_status',
      description:
        'Get the status of orders for the current user. Optionally filter by order status.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
            description: 'Filter orders by status (optional)',
          },
        },
        required: [],
      },
    },
  },
] as const;

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  switch (name) {
    case 'get_product_info':
      return getProductInfo(args.query as string);
    case 'get_order_status':
      return getOrderStatus(userId, args.status as string | undefined);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function getProductInfo(searchQuery: string) {
  return query(
    `SELECT id, name, description, price, stock, category
     FROM products
     WHERE name ILIKE $1 OR description ILIKE $1 OR category ILIKE $1
     LIMIT 5`,
    [`%${searchQuery}%`],
  );
}

async function getOrderStatus(userId: string, status?: string) {
  const base = `
    SELECT o.id, o.status, o.quantity, p.name AS "productName", o.created_at AS "createdAt"
    FROM orders o
    JOIN products p ON o.product_id = p.id
    WHERE o.user_id = $1`;

  return status
    ? query(`${base} AND o.status = $2 ORDER BY o.created_at DESC LIMIT 10`, [userId, status])
    : query(`${base} ORDER BY o.created_at DESC LIMIT 10`, [userId]);
}
