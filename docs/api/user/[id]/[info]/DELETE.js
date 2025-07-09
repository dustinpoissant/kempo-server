export default async function(request, response) {
  const { id, info } = request.params;
  
  // Example response for deleting user info
  const result = {
    id: id,
    message: 'User info deleted successfully',
    deletedAt: new Date().toISOString()
  };
  
  response.json(result);
}
