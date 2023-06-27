import {Wp2Storyblok} from './index.js'
import {fallbackWpToStoryblok} from './src/migration.js'
import 'dotenv/config'
import * as fs from 'fs'
import * as path from "path";

// Handle the tablepress tables
const tablePressJsonDirectoryPath = process.env.TABLEPRESS_EXPORT_DIRECTORY_PATH
const files = fs.readdirSync(tablePressJsonDirectoryPath);
let tableIdToBlockData = {}
files.forEach((file) => {
    if (path.extname(file) === '.json') {
        let filePath = path.join(tablePressJsonDirectoryPath, file);
        const data = fs.readFileSync(filePath, 'utf8');
        const jsonObj = JSON.parse(data);
        let thead = undefined
        let tbody = undefined
        if (jsonObj.options.table_head) {
            thead = jsonObj.data[0].map(colHead => ({value: colHead}))
            tbody = jsonObj.data.slice(1).map(row => ({body: row.map(colItem => ({value: colItem}))}))
        }
        tableIdToBlockData[jsonObj.id] = {
            component: 'table',
            alternatingColors: jsonObj.options.alternating_row_colors,
            content: {
                fieldtype: 'table',
                thead: thead,
                tbody: tbody,
            }
        }
    }
});

const handleShortcoderShortcode = async (block) => {
    if (block.innerContent.length !== 1) {
        console.error('handleShortcoderShortcode got unexpected innerContent length')
    } else if (block.innerContent[0] === '\n[sc name="zip_cta_bottom" ][/sc]\n') {
        return {
            component: 'zipCtaBottom',
        }
    } else if (block.innerContent[0].startsWith('\n[table id=')) {
        const tableId = block.innerContent[0].match(/table id=(\d+)/)[1]
        return tableIdToBlockData[tableId]
    } else {
        console.error(`handleShortcoderShortcode got unexpected shortcode type ${block.innerContent[0]}`)
    }
    return fallbackWpToStoryblok(block)
}


const wp2storyblok = new Wp2Storyblok(process.env.WP_ENDPOINT, {
    token: process.env.STORYBLOK_OAUTH_TOKEN, // My Account > Personal access tokens
    space_id: process.env.STORYBLOK_SPACE_ID, // Settings
    blocks_mapping: [
        {
            name: 'core/paragraph',
            new_block_name: 'richText',
            schema_mapping: {
                'attrs.content': 'content',
            },
        },
        {
            name: 'core/more',
            ignore: true,
        },
        {
            name: 'core/list',
            new_block_name: 'richText',
            schema_mapping: {
                'rendered': 'content',
            },
        },
        {
            name: 'core/image',
            new_block_name: 'image',
            schema_mapping: {
                'attrs.url': 'image',
            },
        },
        {
            name: 'core/group',
            new_block_name: 'group',
            schema_mapping: {
                'innerBlocks': 'bodyItems',
            },
        },
        {
            name: 'core/heading',
            new_block_name: 'heading',
            schema_mapping: {
                'attrs.level': 'level',
                'attrs.content': 'content',
            },
        },
        {
            name: 'shortcoder/shortcoder',
            custom_handler: handleShortcoderShortcode,
        }
    ],
    content_types: [
        {
            name: 'posts', // Post type name in WP
            new_content_type: 'post', // Content Type name in Storyblok
            folder: 'posts', // Destination folder name in Storyblok
            taxonomies: [
                {
                    name: 'categories',
                    field: 'categories',
                    type: 'relationship',
                },
                {
                    name: 'users',
                    field: 'author',
                    type: 'relationship',
                },
            ],
            schema_mapping: {
                "date": "first_published_at",
                "title": "name",
                "slug": "slug",
                "_links.wp:featuredmedia.0": "content.featured_image",
                "author": "content.author",
                "categories": "content.categories",
                "excerpt": "content.excerpt",
                "block_data": "content.body_items",
            },
        },
        {
            name: 'categories', // Name of the post type in WP
            new_content_type: 'category', // Name of the Content Type in Storyblok
            // By default will be contained by a folder called Category (change it in the Permalinks option in WP)
            schema_mapping: {
                "name": "name",
                "slug": "slug",
                "description": "content.description",
                "parent": "content.parent",
            },
        },
        {
            name: 'users',
            new_content_type: 'author',
            schema_mapping: {
                "name": "name",
                "slug": "slug",
                "description": "content.description",
            },
        },
    ]
})

await wp2storyblok.migrate()

console.log("Done!")
