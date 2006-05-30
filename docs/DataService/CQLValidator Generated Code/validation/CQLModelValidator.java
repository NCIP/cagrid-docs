package gov.nih.nci.cagrid.data.cql.validation;

/**
 * This class will validate a CQL query against a caDSR domain model.
 * 
 * The caDSR domain model will be loaded using the supplied model loader
 * @version 1.0
 * @created 30-May-2006 4:41:07 PM
 */
public class CQLModelValidator implements CQLValidator {

	public CQLModelValidator(){

	}

	public void finalize() throws Throwable {

	}

	/**
	 * 
	 * @param modelLoader
	 */
	public CQLModelValidator(DomainModelLoader modelLoader){

	}

	/**
	 * 
	 * Method will return if query is valid or throw a MalformedQueryException if CQL
	 * cannot be validated
	 * 
	 * @param query
	 */
	public void validate(CQLQuery query){

	}

}