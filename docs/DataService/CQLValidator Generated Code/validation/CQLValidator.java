package gov.nih.nci.cagrid.data.cql.validation;

/**
 * 
 * CQL Validator interface that all cql validators will have to implement
 * @version 1.0
 * @created 30-May-2006 4:41:07 PM
 */
public interface CQLValidator {

	/**
	 * 
	 * Method will return if query is valid or throw a MalformedQueryException if CQL
	 * cannot be validated
	 * 
	 * @param query
	 */
	public void validate(CQLQuery query);

}