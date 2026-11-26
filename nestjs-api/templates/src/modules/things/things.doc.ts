import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import {
  ApiCreated,
  ApiErrorResponse,
  ApiErrorResponses,
  ApiNoContent,
  ApiOk,
  ApiPaginatedOk,
} from '../../common/docs/api-responses';

// One example per resource, shared by every decorator below, so list, detail, create and
// update agree on the shape. Serialized form: ISO dates, no internal-only fields.
const thingExample = {
  id: '0f8fad5b-d9cb-469f-a165-70867728950e',
  name: 'Lagos rooftop meetup',
  description: 'Monthly meetup for builders.',
  status: 'active',
  createdById: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  createdAt: '2026-01-31T10:00:00.000Z',
  updatedAt: '2026-01-31T10:00:00.000Z',
};

const idParam = ApiParam({ name: 'id', format: 'uuid', description: 'Thing id' });

export const ListThingsDoc = () =>
  applyDecorators(
    ApiOperation({ summary: 'List things', description: 'Newest first. Filter by status, search name and description.' }),
    ApiPaginatedOk('A page of things.', [thingExample]),
    ApiErrorResponses(400, 401, 403),
  );

export const GetThingDoc = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get a thing' }),
    idParam,
    ApiOk('The thing.', thingExample),
    ApiErrorResponse(404, 'Thing not found'),
    ApiErrorResponses(400, 401, 403),
  );

export const CreateThingDoc = () =>
  applyDecorators(
    ApiOperation({ summary: 'Create a thing', description: 'Names are unique. Status defaults to draft.' }),
    ApiCreated('The created thing.', thingExample),
    ApiErrorResponse(409, 'A thing with this name already exists'),
    ApiErrorResponses(400, 401, 403, 429),
  );

export const UpdateThingDoc = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update a thing', description: 'Only the fields sent are changed.' }),
    idParam,
    ApiOk('The updated thing.', thingExample),
    ApiErrorResponse(404, 'Thing not found'),
    ApiErrorResponse(409, 'A thing with this name already exists'),
    ApiErrorResponses(400, 401, 403),
  );

export const DeleteThingDoc = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete a thing' }),
    idParam,
    ApiNoContent('The thing was deleted.'),
    ApiErrorResponse(404, 'Thing not found'),
    ApiErrorResponses(400, 401, 403),
  );
